import { useLoaderData } from "react-router";
import { SpritesheetPreview } from "~/shared/characters/spritesheet-preview/SpritesheetPreview";
import Typewriter from "~/src/components/Typewriter";
import { useEffect, useState } from "react";
import styles from "./home.module.css";

/**
 * Simple character home component to replace the deleted character.$code.home.tsx
 */
function CharacterHome() {
	const data = useLoaderData<typeof loader>();
	const [isHydrated, setIsHydrated] = useState(false);

	useEffect(() => {
		setIsHydrated(true);
	}, []);

	if (data.type !== "character") return null;
	const { character } = data;

	if (!isHydrated) {
		return (
			<div>
				<h1 className={styles.mainHeader}>{character.freedoomName}</h1>
				<p>Character versions loaded</p>
			</div>
		);
	}

	return (
		<div>
			<h1 className={styles.mainHeader}>
				<Typewriter
					component="span"
					onInit={(typewriter: any) => {
						typewriter
							.typeString(character.freedoomName)
							.callFunction((state: any) => {
								if (state.elements.cursor) {
									state.elements.cursor.style.display = "none";
								}
							})
							.start();
					}}
					options={{
						autoStart: true,
						loop: false,
						cursor: "_",
						delay: 10,
					}}
				/>
			</h1>
			<p>
				<Typewriter
					component="span"
					onInit={(typewriter: any) => {
						typewriter
							.callFunction((state: any) => {
								if (state.elements.cursor) {
									state.elements.cursor.style.display = "none";
								}
							})
							.pauseFor(1000)
							.callFunction((state: any) => {
								if (state.elements.cursor) {
									state.elements.cursor.style.display = "inline-block";
								}
							})
							.typeString("Character versions loaded")

							.start();
					}}
					options={{
						autoStart: true,
						loop: false,
						cursor: "_",
						delay: 10,
					}}
				/>
			</p>
		</div>
	);
}

/**
 * Route resolver that determines whether to show a spritesheet preview
 * (for UUIDs) or character home page (for character codes)
 */
export default function SlugResolver() {
	const { type } = useLoaderData<typeof loader>();

	if (type === "uuid") {
		return <SpritesheetPreview />;
	}

	if (type === "character") {
		return <CharacterHome />;
	}

	return <div>Not found</div>;
}

export function meta({ data }: { data: any }) {
	if (!data || !data.type) {
		return [{ title: "Not Found - Freedoom Bestiary" }];
	}

	if (data.type === "character") {
		const { character, slug } = data;
		return [
			{ title: `${character.freedoomName || slug} - Freedoom Bestiary` },
			{
				name: "description",
				content: `Historical spritesheets for ${character.freedoomName || slug}`,
			},
		];
	}

	return [{ title: "Spritesheet Preview - Freedoom Bestiary" }];
}

export async function loader({ params }: { params: { slug: string } }) {
	const slug = params.slug;
	const { CharacterRepository } = await import("../repositories.server");

	// Check if slug is a UUID (simple check for uuid format)
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	if (uuidRegex.test(slug)) {
		return { type: "uuid" as const, slug };
	}

	// Check if slug is a valid character code
	const code = slug.toUpperCase();
	try {
		const character = CharacterRepository.getCharacter(code as any);
		return { type: "character" as const, character, slug: code };
	} catch {
		throw new Response("Not Found", { status: 404 });
	}
}
