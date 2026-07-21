# Calorie Tracker

A personal food and calorie tracking app focused on quick, low-friction logging.

## Language

**User**:
A person who signs in and owns their own days, entries, meals, and settings.

**Entry**:
A single food item logged for a specific day, with calories and macros.

**Meal**:
A reusable combination of ingredients that can be added to a day as one entry.
_Avoid_: preset, template, recipe

**Ingredient**:
A single food item inside a meal, with its own macros and amount in grams.

**Snapshot**:
The frozen set of macros and ingredients copied from a meal onto a day entry at the moment it is logged. Editing the meal later does not change historical snapshots.

## Relationships

- A **User** owns many **Days**
- A **User** owns many **Meals**
- A **User** has exactly one **Settings**
- A **Day** contains many **Entries**
- A **Meal** contains many **Ingredients**
- Adding a **Meal** to a **Day** creates one **Entry** plus a **Snapshot** of the meal's ingredients and totals

## Example dialogue

> **Dev:** "If I change a saved meal, should today's entry update too?"
> **Domain expert:** "No — each day entry stores a snapshot. The meal can change, but history stays the same."
