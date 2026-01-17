import { Redirect, type Href } from "expo-router";

export default function ExploreScreen() {
  return <Redirect href={"/(tabs)/index" as Href} />;
}
