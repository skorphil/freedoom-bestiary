import { SpritesheetPreview } from "~/shared/characters/spritesheet-preview/SpritesheetPreview";

type RouteData = {
	id: string;
	authorId: string;
};

export function meta({ data }: { data: RouteData | undefined }) {
	if (!data) {
		return [{ title: "Spritesheet Not Found - Freedoom Bestiary" }];
	}

	return [{ title: "Spritesheet Contribution - Freedoom Bestiary" }];
}

export async function loader({ params }: { params: { authorId: string; id: string } }) {
	return {
		id: params.id,
		authorId: params.authorId,
	};
}

export default function AuthorSpritesheetDetail() {
	return <SpritesheetPreview />;
}