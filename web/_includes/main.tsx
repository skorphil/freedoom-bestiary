export default ({ title, children }: Lume.Data) => {
	return (
		<html lang="en">
			<head>
				<meta charset="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<base href="https://skorphil.github.io/freedoom-bestiary/" />
				<title>{title || "Freedoom Bestiary"}</title>
				<link rel="stylesheet" href="styles.css" />
			</head>
			<body>
				<main>{children}</main>
				<footer>
					<a href="https://github.com/skorphil/freedoom-bestiary">Github</a>
				</footer>
			</body>
		</html>
	);
};
