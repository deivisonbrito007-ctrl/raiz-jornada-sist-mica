import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

test("renders button with given label", () => {
  render(<Button>Teste</Button>);
  expect(screen.getByRole("button")).toHaveTextContent("Teste");
});
