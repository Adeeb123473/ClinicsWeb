import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";

export function NotAuthorizedPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
      <EmptyState
        title="Not authorized"
        description="Your account role doesn't have access to this page."
        action={
          <Link to="/">
            <Button variant="secondary">Back to safety</Button>
          </Link>
        }
      />
    </div>
  );
}
