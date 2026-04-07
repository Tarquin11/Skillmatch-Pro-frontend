# SkillmatchProFront

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Environment configurations

The app supports environment-specific API base URLs:

- `src/environments/environment.development.ts`
- `src/environments/environment.staging.ts`
- `src/environments/environment.production.ts`

Build by target environment:

```bash
npm run build:dev
npm run build:stage
npm run build:prod
```

## Production build checks

To run production build + deployment safety checks:

```bash
npm run build:prod:check
```

Checks include:

- no hardcoded localhost API URL in built assets
- no source maps in production output

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
npm run test:unit
```

## Running end-to-end tests

For Playwright smoke e2e (login -> dashboard -> matching), run:

```bash
npm run e2e
```

Environment variables:

- `E2E_BASE_URL` (default: `http://127.0.0.1:4200`)
- `E2E_API_URL` (default: `http://127.0.0.1:8000`)
- `E2E_PASSWORD` (default: `SmokePass123!`)

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
