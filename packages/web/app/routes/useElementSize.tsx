import { useState, useEffect, useRef } from "react";

export function useElementSize() {
	const elementRef = useRef(null);
	const [size, setSize] = useState({ width: 0, height: 0 });

	useEffect(() => {
		const element = elementRef.current;
		if (!element) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (let entry of entries) {
				const { width, height } = entry.contentRect;
				setSize({ width, height });
			}
		});

		resizeObserver.observe(element);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	return [elementRef, size];
}
