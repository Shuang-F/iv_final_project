import cube from "../data/processed/crime-cube.json";
import meta from "../data/processed/crime-meta.json";
import districtGeo from "../data/processed/police-districts-real.json";
import CrimeStoryApp from "../components/CrimeStoryApp";

export default function Home() {
  return <CrimeStoryApp cube={cube} meta={meta} districtGeo={districtGeo} />;
}
