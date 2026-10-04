import security from "eslint-plugin-security";

export default [
    {
        ignores: ["dist/**", "public/vendor/**", "node_modules/**"]
    },
    security.configs.recommended,
    {
        files: ["**/*.js", "**/*.ts"],
        languageOptions: {
            parser: (await import("@typescript-eslint/parser")).default
        }
    }
];