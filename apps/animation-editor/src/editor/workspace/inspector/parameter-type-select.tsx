import type { ParameterDefinition } from "@ggez/anim-schema";
import { editorSelectClassName } from "../shared";

export function ParameterTypeSelect(props: {
  value: ParameterDefinition["type"];
  onChange: (value: ParameterDefinition["type"]) => void;
}) {
  return (
    <select value={props.value} onChange={(event) => props.onChange(event.target.value as ParameterDefinition["type"])} className={editorSelectClassName}>
      <option value="float">Float</option>
      <option value="int">Int</option>
      <option value="bool">Bool</option>
      <option value="trigger">Trigger</option>
    </select>
  );
}
