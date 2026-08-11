import React from "react";
import Script from "next/script";
import dbConnect from "@/lib/db";
import ScriptModel from "@/models/Script";
import SiteConfig from "@/models/SiteConfig";
import ClientScriptLoader from "./ClientScriptLoader";

/**
 * Enterprise Server-Side Script Injection Engine
 * Fetches all scripts on the server, injecting global scripts and verification tags
 * directly into the initial HTML response. Route-specific tracking/marketing scripts
 * are delegated to ClientScriptLoader for client-side route tracking.
 */

const parseAttributes = (attrStr) => {
  const attrs = {};
  const regex = /([a-zA-Z0-9-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = regex.exec(attrStr)) !== null) {
    const name = match[1];
    const value = match[2] !== undefined ? match[2] : (match[3] !== undefined ? match[3] : match[4]);
    if (name === 'class') {
      attrs.className = value;
    } else {
      attrs[name] = value === undefined ? true : value;
    }
  }
  return attrs;
};

const parseHtmlToReact = (html, keyPrefix) => {
  if (!html) return null;
  const tags = [];
  const regex = /<([a-zA-Z1-6]+)\b([^>]*)(?:>([\s\S]*?)<\/\1>|\s*\/?>)/gi;
  let match;
  let index = 0;
  while ((match = regex.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrStr = match[2];
    const innerContent = match[3];
    const attrs = parseAttributes(attrStr);
    attrs.key = `${keyPrefix}-${tagName}-${index++}`;
    
    if (tagName === 'script') {
      if (innerContent) {
        tags.push(<script {...attrs} dangerouslySetInnerHTML={{ __html: innerContent }} />);
      } else {
        tags.push(<script {...attrs} />);
      }
    } else if (tagName === 'style') {
      tags.push(<style {...attrs} dangerouslySetInnerHTML={{ __html: innerContent || '' }} />);
    } else if (tagName === 'meta' || tagName === 'link') {
      const Tag = tagName;
      tags.push(<Tag {...attrs} />);
    } else {
      const Tag = tagName;
      if (innerContent) {
        tags.push(<Tag {...attrs} dangerouslySetInnerHTML={{ __html: innerContent }} />);
      } else {
        tags.push(<Tag {...attrs} />);
      }
    }
  }
  if (tags.length === 0 && html.trim()) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return tags;
};

export default async function ScriptLoader({ location = "head" }) {
  try {
    await dbConnect();
    
    // 1. Check for Global Emergency Kill Switch
    const config = await SiteConfig.findOne({ key: 'main' }).lean();
    if (config?.features?.disableAllScripts) {
      console.warn(`[ScriptLoader] Emergency Kill Switch is ACTIVE. No scripts will be loaded for ${location}.`);
      return null;
    }

    // 2. Fetch active scripts
    const activeScripts = await ScriptModel.find({ isActive: true })
      .select('name type code location templateConfig loadStrategy targeting priority')
      .sort({ priority: 1 })
      .lean();

    // Map script objects to plain objects to avoid serialization issues
    const serializedScripts = JSON.parse(JSON.stringify(activeScripts));

    // 3. Filter by Location
    const locationScripts = serializedScripts.filter(s => s.location === location);

    // 4. Split into server-side (global / verification) vs client-side (route targeted)
    const serverScripts = locationScripts.filter(s => !s.targeting || s.targeting.type === 'all' || s.type === 'verification');
    const clientScripts = locationScripts.filter(s => s.targeting && s.targeting.type !== 'all' && s.type !== 'verification');

    // 5. De-duplicate server scripts (Keep only one script per unique template ID)
    const uniqueServerScripts = [];
    const seenIds = new Set();

    serverScripts.forEach(s => {
      const uniqueKey = s.type === 'custom' ? s._id : `${s.type}-${s.templateConfig.trackingId || s.templateConfig.pixelId || s.templateConfig.verificationId}`;
      if (!seenIds.has(uniqueKey)) {
        uniqueServerScripts.push(s);
        seenIds.add(uniqueKey);
      }
    });

    const renderScript = (s) => {
      const { type, templateConfig, loadStrategy, _id } = s;
      const scriptId = _id.toString();
      
      const strategyMap = {
          'async': 'afterInteractive',
          'defer': 'afterInteractive',
          'beforeInteractive': 'beforeInteractive',
          'afterInteractive': 'afterInteractive',
          'lazyOnload': 'lazyOnload'
      };
      const strategy = strategyMap[loadStrategy] || 'afterInteractive';

      switch (type) {
        case 'ga4':
          return (
            <React.Fragment key={scriptId}>
              <Script 
                id={`ga4-js-${scriptId}`}
                src={`https://www.googletagmanager.com/gtag/js?id=${templateConfig.trackingId}`}
                strategy={strategy}
              />
              <Script id={`ga4-init-${scriptId}`} strategy={strategy}>
                {`
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${templateConfig.trackingId}', {
                      page_path: window.location.pathname,
                  });
                `}
              </Script>
            </React.Fragment>
          );
        
        case 'gtm':
          return (
            <Script key={scriptId} id={`gtm-init-${scriptId}`} strategy={strategy}>
              {`
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${templateConfig.trackingId}');
              `}
            </Script>
          );

        case 'meta_pixel':
          return (
            <Script key={scriptId} id={`meta-pixel-${scriptId}`} strategy={strategy}>
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${templateConfig.pixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
          );

        case 'verification':
          const provider = templateConfig.verificationProvider || 'google';
          const nameMap = {
              'google': 'google-site-verification',
              'pinterest': 'p:domain_verify',
              'bing': 'msvalidate.01',
              'facebook': 'facebook-domain-verification'
          };
          const metaName = nameMap[provider] || 'google-site-verification';
          return <meta key={scriptId} name={metaName} content={templateConfig.verificationId} />;

        case 'custom':
          if (!s.code) return null;
          return parseHtmlToReact(s.code, `server-custom-${scriptId}`);

        default:
          return null;
      }
    };

    return (
      <>
        {uniqueServerScripts.map((s) => renderScript(s))}
        {clientScripts.length > 0 && (
          <ClientScriptLoader scripts={clientScripts} location={location} />
        )}
      </>
    );

  } catch (error) {
    console.error("ScriptLoader SSR Error:", error);
    return null;
  }
}
