import { ParentComponent } from "solid-js";

export const Kbd: ParentComponent = (props) => (
  <kbd class="rounded-sm border-b-4 border-green-700 bg-green-900 px-1">
    {props.children}
  </kbd>
);
