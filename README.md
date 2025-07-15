# Installation

`npm install`

# Run

`npm run dev` to build the front-end and run the electron app in development mode

## Build the front-end

- `npm run build` to build the front-end
- `npm run dev:vite` to run only the front-end with hot-reload

## Run the electron app

- `npm start` to run the electron app (build front-end before), or
- `npm start:forge` then just use `rs` to [restart](https://www.electronforge.io/cli#start).

# Linting

`npm run lint` or `npm run lint:fix` to auto-fix.  
Automatic linting check is done on commit with husky.

# Packaging

## Linux

`npm run make:deb`

## MacOS

Only works on macOS systems  
`npm run make:macos`
