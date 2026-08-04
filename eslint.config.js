import security from "eslint-plugin-security";

export default [
    security.configs.recommended,
    {
        files: ["**/*.js", "**/*.ts"],
        ignores: ["dist/**", "public/vendor/**", "node_modules/**"],
        languageOptions: {
            parser: (await import("@typescript-eslint/parser")).default
        }
    }
];