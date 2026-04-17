import { type WithElementRef } from "bits-ui";
import Root from "./switch.svelte";

type Props = WithElementRef<Root["$$prop_def"]>;

export {
	Root,
	type Props,
	//
	Root as Switch,
	type Props as SwitchProps
};
