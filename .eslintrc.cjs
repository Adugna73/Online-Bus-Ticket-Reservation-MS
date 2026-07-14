module.exports = {
    root: true,
    // Use Next's recommended config. Avoid requiring extra plugins.
    extends: ["next/core-web-vitals"],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
    },
    ignorePatterns: [".next/", "out/", "build/", "node_modules/", "archive/"],
    rules: {
        // keep defaults; override if you want stricter checks
    },
};
