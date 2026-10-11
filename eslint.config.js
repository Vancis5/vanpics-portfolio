import security from "eslint-plugin-security";

export default [
    {
        ignores: ["dist/**", "public/vendor/**", "node_modules/**", "archive/**", "test-artifacts/**", "test-results/**", "backfill-output/**"]
    },
    security.configs.recommended,
    {
        files: ["**/*.js", "**/*.ts"],
        languageOptions: {
            parser: (await import("@typescript-eslint/parser")).default
        }
    }
];