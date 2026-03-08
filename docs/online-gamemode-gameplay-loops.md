# Online Gamemode Gameplay Loops

| Gamemode | Gameplay Loop |
| --- | --- |
| Imposter | `Display Start Timer -> Display Answer Container -> Display Private Card (vote) -> Display Vote Results -> Vote Results Part 2 -> (Punishment or Reset) -> Next Player -> Repeat` |
| Mafia | `Display Role -> Night Phase -> Night Vote Resolve -> Player Killed -> Day Discussion -> Day Vote -> Town Vote Resolve -> (Game Over? If no: back to Night Phase) -> Repeat` |
| Most Likely To | `Display Private Card -> Display Vote Results -> (Tie? Tie-break punishment path : Standard punishment path) -> Reset Question -> Repeat` |
| Never Have I Ever | `Display Private Card -> Display Vote Results -> (Punishment selection/offer/confirm flow) -> Reset Question -> Repeat` |
| Paranoia | `Display Private Card (reading) -> Display Dual Stack Card -> Next Question -> Player vote/choice -> (Punishment flow or Time Expired flow) -> Reset/Next Question -> Repeat` |
| Truth Or Dare | `Display Select Question Type -> Display Public Card -> (Answer flow : Pass -> Punishment flow) -> Display Complete Question -> Next User Turn -> Select Question Type -> Repeat` |
| Would You Rather | `Display Private Card -> Display Vote Results -> (Punishment flow for losing side) -> Reset Question (winning option scoring) -> Repeat` |

## Notes

- The loops above are based on each mode's online instruction handlers in `public/scripts/party-games/gamemode/online/*/*-online-setup.js`, `*-online-logic.js`, and `*-online-instructions.js`.
- Punishment branches include mode-specific states like `CHOOSING_PUNISHMENT`, `CHOSE_PUNISHMENT`, `DISPLAY_PUNISHMENT_TO_USER`, and confirmation/pass states.
