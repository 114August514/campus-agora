import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Component tests need a DOM. Registered once here and pulled in by
// bunfig.toml so every test file gets the same environment.
GlobalRegistrator.register();
