import TypewriterComponent from "typewriter-effect";

/**
 * A safe wrapper for typewriter-effect to handle CJS/ESM interop issues.
 * Error #130 often occurs when a component is undefined due to incorrect export resolution.
 */
const Typewriter = (TypewriterComponent as any).default || TypewriterComponent;

export default Typewriter;
