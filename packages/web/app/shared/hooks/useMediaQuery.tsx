import { useEffect, useState } from "react";

/**
 * Custom hook to track the state of a media query.
 * 
 * @example
 * const isMobile = useMediaQuery("(max-width: 768px)");
 * 
 * @example
 * const isDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
 */
export function useMediaQuery(query: string) {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const media = window.matchMedia(query);
		if (media.matches !== matches) {
			setMatches(media.matches);
		}

		const listener = () => setMatches(media.matches);
		media.addEventListener("change", listener);

		return () => media.removeEventListener("change", listener);
	}, [matches, query]);

	return matches;
}
