# Installation

`npm install`

# Run

`npm run dev` to build the front-end and run the electron app in development mode

### Build the front-end

- `npm run build` to build the front-end
- `npm run dev:vite` to run only the front-end with hot-reload

### Run the electron app

- `npm start` to run the electron app (build front-end before), or
- `npm start:forge` then just use `rs` to [restart](https://www.electronforge.io/cli#start).

# Code quality

### Linting

Eslint is used for linting. Run the following to lint     
`npm run lint` and `npm run lint:fix` to auto-fix.  

### Formatting

Prettier is used for formatting. Run the following to format the code or use your IDE   
`npm run format`

### Automatic linting and formatting at commit
[Husky](https://typicode.github.io/husky/) is used to run linting and formatting at commit.  
If something is not correct with Eslint, the commit will be aborted. Then Prettier will format the code but a new commit will be needed to include the formatting changes. This gives more control over the modifications made during the commit process.  
Automatic scripts executed prior commit are defined in [.husky/pre-commit](.husky/pre-commit).


# Packaging

### Linux

`npm run make:deb`

### MacOS

Only works on macOS systems  
`npm run make:macos`
