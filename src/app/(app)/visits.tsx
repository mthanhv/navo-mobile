import { VisitList } from "../../components/Visits";
import { useSession } from "../../lib/session";

/** Planned maintenance and repair visits: planners see everyone's, technicians their own. */
export default function VisitsScreen() {
  const { can } = useSession();
  return <VisitList mine={!can("service.plan")} />;
}
