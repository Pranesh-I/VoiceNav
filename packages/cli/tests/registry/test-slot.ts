import { inferSlots } from "../../src/registry/generators/slot-inference.js";

const capability = {
  id: "test",
  type: "route",
  sourceFile: "",
  sourceLocation: "",
  metadata: {
    path: "/users/[id]",
  },
};

console.log(inferSlots(capability));