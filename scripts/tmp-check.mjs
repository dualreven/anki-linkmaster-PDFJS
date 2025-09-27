import { createRequire } from "module";
const req = createRequire(process.cwd()+"/package.json");
console.log(req.resolve("@babel/plugin-transform-private-methods"));