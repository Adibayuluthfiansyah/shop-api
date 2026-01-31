import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrate: {
    datasource: "db",
    url: "postgresql://postgres:postgres123@localhost:5433/shopapi_db",
  },
});
