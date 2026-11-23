// Loads the 3D rack engine in the browser only. engine.js is the unchanged OFFCUT rack engine: it reads
// window.THREE (with GLTFLoader + RoomEnvironment) and window.gsap when it is evaluated, then sets window.Rack3D.
let loading = null;

export function loadRack3D() {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (window.Rack3D) return Promise.resolve(window.Rack3D);
  if (!loading) {
    loading = (async () => {
      const [THREE, { GLTFLoader }, { RoomEnvironment }, gsapMod] = await Promise.all([
        import("three"),
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/environments/RoomEnvironment.js"),
        import("gsap"),
      ]);
      window.THREE = Object.assign({}, THREE, { GLTFLoader, RoomEnvironment });
      window.gsap = gsapMod.gsap || gsapMod.default;
      await import("./engine.js");
      return window.Rack3D;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}
