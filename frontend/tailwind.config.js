/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        signal: {
          teal: "#2C6BED",
          "teal-dark": "#1A4FB8",
          "teal-light": "#EBF1FD",
          bubble: "#E9F0FD",
          "bubble-mine": "#2C6BED",
          bg: "#F0F2F5",
          sidebar: "#FFFFFF",
          border: "#E9EDEF",
          text: "#1C1E21",
          secondary: "#667085",
          unread: "#25D366",
          online: "#25D366",
          icon: "#54656F",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        message: "0 1px 0.5px rgba(11,20,26,0.13)",
      },
    },
  },
  plugins: [],
};
