import type { Contributor } from "@freedoom-bestiary/database";
import { useLoaderData } from "react-router";
import Typewriter from "typewriter-effect";
import styles from "./home.module.css";

type RouteData = {
	authorId: string;
	name: string;
	contributionsCount: number;
};

export function meta({ data }: { data: RouteData | undefined }) {
	if (!data) {
		return [{ title: "Author Not Found - Freedoom Bestiary" }];
	}

	const { name } = data;
	return [{ title: `Contributions by ${name} - Freedoom Bestiary` }];
}

export async function loader({ params }: { params: { authorId: string } }) {
	const { ContributorRepository, SpritesheetRepository, CharacterRepository } =
		await import("../repositories.server");
	const { createSpritesheetsCollection } = await import("../src/models/SpritesheetsCollection");

	try {
		const contributor: Contributor = ContributorRepository.getContributorById(params.authorId);

		const allSheets = await SpritesheetRepository.getAllSpritesheets();
		const allCharacters = CharacterRepository.getAllCharacters();
		const allContributors = ContributorRepository.getAllContributors();
		const collection = createSpritesheetsCollection(allSheets, allCharacters, allContributors);

		const contributions = collection.getAuthorContributions(contributor.name);

		return {
			authorId: params.authorId,
			name: contributor.name,
			contributionsCount: contributions.length,
		};
	} catch {
		throw new Response("Author not found", { status: 404 });
	}
}

function AuthorHome() {
	const { name, contributionsCount } = useLoaderData<typeof loader>();

	return (
		<div>
			<h1 className={styles.mainHeader}>
				<Typewriter
					onInit={(typewriter) => {
						typewriter
							.typeString(`Contributor >> ${name}`)
							.callFunction((state) => {
								state.elements.cursor.style.display = "none";
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
					onInit={(typewriter) => {
						typewriter
							.callFunction((state) => {
								state.elements.cursor.style.display = "none";
							})
							.pauseFor(1000)
							.callFunction((state) => {
								state.elements.cursor.style.display = "inline-block";
							})
							.typeString(`${contributionsCount} contributions loaded`)

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

export default function AuthorPageRoute() {
	return <AuthorHome />;
}
