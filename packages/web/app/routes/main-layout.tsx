import { Outlet, useParams } from "react-router";
import CharactersList from "~/pages/main-page/CharactersList";
import { VersionsList } from "~/pages/character-page/VersionsList";
import { AuthorContributionsList } from "~/pages/author-page/AuthorContributionsList";
import { useSpritesheets } from "~/src/context/SpritesheetsContext";
import styles from "./index.module.css";

/**
 * Main layout that displays either all characters, character versions, or author contributions
 * based on URL parameters
 */
export default function MainLayout() {
	const params = useParams();
	const collection = useSpritesheets();
	
	const slug = params.slug;
	const codeParam = params.code;
	const authorId = params.authorId;

	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	
	const isUuid = slug ? uuidRegex.test(slug) : false;
	const codes = collection?.getAllCodes() || [];
	const isCode = slug && !isUuid ? codes.includes(slug.toUpperCase() as any) : false;
	
	const currentCode = isCode ? slug?.toUpperCase() : codeParam?.toUpperCase();
	const isShowingPreview = !!params.id || isUuid;

	if (!collection) {
		return <div>Loading spritesheets...</div>;
	}

	return (
		<div className={styles.layoutArea}>
			<div
				className={`
        ${styles.snippetList}
        ${!isShowingPreview ? styles.activePanel : styles.inactivePanel}
      `}
			>
				{authorId ? (
					<AuthorContributionsList authorId={authorId} />
				) : currentCode ? (
					<VersionsList spriteCode={currentCode as any} />
				) : (
					<CharactersList />
				)}
			</div>
			<div
				className={`
        ${styles.contentArea}
        ${isShowingPreview || (slug && !isCode && !isUuid) ? styles.activePanel : styles.inactivePanel}
      `}
			>
				<Outlet />
			</div>
		</div>
	);
}
