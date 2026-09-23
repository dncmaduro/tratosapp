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
          // pnpm paths contain nested node_modules entries. Use the final one,
          // otherwise every dependency is grouped under the `.pnpm` folder.
          const modulePath = id.slice(id.lastIndexOf("node_modules/") + 13)
          if (modulePath.startsWith("@mantine/")) return "vendor-mantine"
          if (modulePath.startsWith("@tanstack/")) return "vendor-tanstack"
          if (modulePath.startsWith("@tabler/icons-react")) return "vendor-icons"
          if (/^(react|react-dom|scheduler)(\/|$)/.test(modulePath)) {
            return "vendor-react"
          }
          if (modulePath.startsWith("xlsx/")) return "vendor-xlsx"
          if (modulePath.startsWith("recharts/")) return "vendor-charts"
          if (modulePath.startsWith("html2canvas/")) return "vendor-html2canvas"
          if (modulePath.startsWith("socket.io-client/")) return "vendor-socket"
          if (modulePath.startsWith("lodash/")) return "vendor-lodash"
          return "vendor"
        }
      }
    }
  }
})
