import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { execaSync } from "execa"

const getCommit = () => {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VITE_GIT_COMMIT ||
    process.env.GIT_COMMIT

  if (commit) return commit.slice(0, 7)

  try {
    return execaSync("git", ["rev-parse", "--short", "HEAD"]).stdout.trim()
  } catch {
    return "unknown"
  }
}

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(getCommit())
  },
  plugins: [
    react(),
    tailwindcss()
  ],
  server: { port: 8386 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          const parts = id.split("node_modules/")[1].split("/")
          return parts[0].startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0]
        }
      }
    }
  }
})
