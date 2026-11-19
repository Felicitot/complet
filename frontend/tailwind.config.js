/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0C2340",
        navy2: "#143862",
        canvas: "#F2F5F8",
        paper: "#FFFFFF",
        ink: "#13202E",
        inkmuted: "#5B6B7A",
        line: "#E4E9EF",
        vent: "#2E6FDB",
        pluies: "#1F8F52",
        houles: "#E07B1F",
        temperatures: "#7B3FA0",
        satellites: "#17A398",
        previsions: "#D1452C",
      },
      fontFamily: {
        display: ["\"Fraunces\"", "serif"],
        body: ["\"Inter\"", "sans-serif"],
      },
    },
  },
  plugins: [],
};
