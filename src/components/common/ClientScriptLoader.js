"use client";

import React from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * ClientScriptLoader handles route-targeted scripts client-side
 * utilizing usePathname() to dynamically execute scripts as paths change.
 */
export default function ClientScriptLoader({ scripts = [], location = "head" }) {
  const pathname = usePathname();

  // 1. Filter by Location
  const locationScripts = scripts.filter(s => s.location === location);

  // 2. Filter by Route Targeting (Glob + Exclusion support)
  const activeScripts = locationScripts.filter(s => {
    if (!s.targeting || s.targeting.type === 'all') return true;
    
    const { routes, type } = s.targeting;
    
    const checkMatch = (path, pattern) => {
        if (pattern.startsWith('!')) {
            return !checkMatch(path, pattern.slice(1));
        }
        if (pattern.endsWith('*')) {
            return path.startsWith(pattern.slice(0, -1));
        }
        return path === pattern;
    };

    const isMatched = routes.some(pattern => checkMatch(pathname, pattern));
    return type === 'specific' ? isMatched : !isMatched;
  });

  // 3. De-duplication (Keep only one script per unique template ID)
  const uniqueScripts = [];
  const seenIds = new Set();

  activeScripts.forEach(s => {
    const uniqueKey = s.type === 'custom' ? s._id : `${s.type}-${s.templateConfig.trackingId || s.templateConfig.pixelId || s.templateConfig.verificationId}`;
    if (!seenIds.has(uniqueKey)) {
        uniqueScripts.push(s);
        seenIds.add(uniqueKey);
    }
  });

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
        return parseHtmlToReact(s.code, `client-custom-${scriptId}`);

      default:
        return null;
    }
  };

  return (
    <>
      {uniqueScripts.map((s) => renderScript(s))}
    </>
  );
}
