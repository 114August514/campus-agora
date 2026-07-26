import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Component tests need a DOM. Registered once here and pulled in by
// bunfig.toml so every test file gets the same environment.
GlobalRegistrator.register();

// Tests must never reach a real server, so the API client always runs against
// the typed mock. Set before any module reads it.
process.env.VITE_API_MOCK = "true";
