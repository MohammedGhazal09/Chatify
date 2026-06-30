Feature: Chatify Phase 42-49 visual QA evidence

  Scenario: Verify Chatify phase visual QA artifacts exist
    Given I have the Chatify repository at "D:\Projects\Chatify"
    When I inspect ".planning/phases/42-49-hercules-visual-qa/HERCULES-VISUAL-QA.md"
    Then I should see "Passed with fixes"
    And I should see "Phase 42"
    And I should see "Phase 49"
    And I should find 23 screenshots in ".planning/phases/42-49-hercules-visual-qa/screenshots"
