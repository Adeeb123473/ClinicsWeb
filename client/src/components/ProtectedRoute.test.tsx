import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { useAuthStore } from "../store/authStore";

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/app"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<div>App Home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it("redirects to /login when there is no authenticated user", () => {
    render(<TestApp />);

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("App Home")).not.toBeInTheDocument();
  });

  it("renders the nested route once a user is authenticated", () => {
    useAuthStore.getState().setSession(
      {
        userId: "u1",
        username: "reception1",
        fullName: "Reception One",
        role: "RECEPTIONIST",
        clinicId: "clinic-1",
        mustChangePassword: false,
      },
      "fake-access-token",
    );

    render(<TestApp />);

    expect(screen.getByText("App Home")).toBeInTheDocument();
  });
});
