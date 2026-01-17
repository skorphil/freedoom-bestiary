## About
This project's goal is to create a web page, featuring all the enemies of [FreeDoom](https://freedoom.github.io/). 


## Roadmap
1. Create a script to generate page out of existing git commits
2. Create automation which will automatically add enemies future sprites to the bestiary page
3. Integrate with FreeDoom official page (?)


## Tech
- Deno. Chosen to replicate `.ipynb` experience with js (to avoid language switching). 
(At the moment only Polyglot Notebooks are good alternative, but they lack autocomplete
and require to use C for filesystem access)


## Contribute
1. [Install Deno](https://docs.deno.com/runtime/getting_started/installation/)
2. [Install deno jupyter kernel](https://docs.deno.com/runtime/reference/cli/jupyter/) `deno jupyter`

### For VS Code
2. Install *jupyter extension* (It is provided as recommended in a project)
3. Set up `"editor.defaultFormatter": "denoland.vscode-deno"` for typescript (Workspace
settings provided in a project)
4. To run deno in `.ipynb` select deno kernel in jupyter notebook
 