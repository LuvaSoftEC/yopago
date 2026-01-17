import { Redirect, type Href } from 'expo-router';

export default function MyGroupsRedirect() {
  return <Redirect href={"/(tabs)/my-groups" as Href} />;
}
