import "./assets/styles.css";
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from "react-router";
import { SpritesheetsProvider } from "./src/context/SpritesheetsContext";

export async function loader() {
	const {
		CharacterRepository,
		ContributorRepository,
		SpritesheetRepository,
	} = await import("./repositories.server");

	const allSheets = await SpritesheetRepository.getAllSpritesheets();
	const allCharacters = CharacterRepository.getAllCharacters();
	const allContributors = ContributorRepository.getAllContributors();
	return { allSheets, allCharacters, allContributors };
}

export function Layout({ children }: { children: React.ReactNode }) {
	const data = useLoaderData<typeof loader>();

	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link
					rel="preconnect"
					href="https://fonts.gstatic.com"
					crossOrigin=""
				/>
				<link
					href="https://fonts.googleapis.com/css2?family=VT323&display=swap"
					rel="stylesheet"
				/>
				<Meta />
				<Links />
			</head>
			<body>
				{data ? (
					<SpritesheetsProvider
						data={data.allSheets}
						characters={data.allCharacters}
						contributors={data.allContributors}
					>
						{children}
					</SpritesheetsProvider>
				) : (
					<p>Error loading spritesheet data</p>
				)}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}
