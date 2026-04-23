@pending
Feature: New application → setup workflow → first iteration (golden path)

  # Marked @pending until the scaffolder side of the flow runs hermetically
  # in CI (bun + vite + real scaffold are out of scope for v1 of 092).
  # The scenario YAML and this .feature ship together so authors of the
  # follow-up PR can turn @pending into an active run by removing this tag.

  Scenario: User creates an app and iterates once
    Given I am running scenario "new-app-html-elements"
    When I open the applications list
    Then the web server should respond with the applications page
