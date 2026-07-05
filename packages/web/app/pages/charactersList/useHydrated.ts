import { useEffect, useState } from "react";

/**
 * Hook to detect if the component has been hydrated on the client.
 * Returns false during SSR and initial hydration, true after mount.
 */
export function useHydrated() {
	const [hydrated, setHydrated] = useState(false);
	useEffect(() => {
		setHydrated(true);
	}, []);
	return hydrated;
}
