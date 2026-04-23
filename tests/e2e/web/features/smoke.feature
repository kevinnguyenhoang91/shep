Feature: E2E mock infrastructure smoke test

  As an infra maintainer
  I want a minimal feature that proves playwright-bdd + the scenario
  replay wiring start up correctly
  So that future features can add scenarios without reauthoring the
  harness

  Scenario: The web server boots under SHEP_E2E_MOCK_AGENT and serves the applications page
    Given I am running scenario "smoke"
    Then the web server should respond with the applications page
