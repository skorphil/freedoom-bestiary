## Data structure for freedoom bestiary

```mermaid
%%{init: { 'theme': 'dark' } }%%

erDiagram
    direction TB
    CONTRIBUTION |o..|| CONTRIBUTOR : "reference"
    CHARACTER ||--|{ ANIMATION : "contains"
    SPRITESHEET ||--|{ SPRITE : "contains"
    ANIMATION ||--|{ STEP : contains
    SPRITE ||--|{ CONTRIBUTION : "contains array of"
    CHARACTER ||--|{ SPRITESHEET : "contains"


    CHARACTER {
        enum spriteCode PK "POSS | SPOS ..."
        string freedoomName
        string freedoomDescription

    }


    CONTRIBUTOR {
        string name
        string[] aliases
    }

    CONTRIBUTION {
        string contributorId FK
        string relation "AI generated relation, based on git message, CREDITS and git commiter"
    }

    SPRITE {
        string spriteUrl "direct github url to sprite"
        string frame
        int angle
        int x
        int y
        int width
        int height
        enum state "State, relative to spritesheet commit: (new | updated | unchanged)"
    }

    SPRITESHEET {
        string spritesheetId "UUID"
        string fileName "[spriteCode].[sha].[spritesheetId].webp"
        string filePath "[fileName] location"
        date commitDate
        string commitSha
        string commitMessage
        string commitUrl
    }

    ANIMATION {
        enum name "Idling | Chasing ..."
    }

    STEP {
        string frame
        int delay
    }
```


## Character
Static entity, with pre-defined standard Doom2 properties and extra FreeDoom-related data. It is either enemy ("POSS" | "FATT" ...) or player "PLAY"


## Animation
Static entity, containing standard sequences of animations for characters from Doom2


## Spritesheet
A specific version(snapshot) of a single character's design. Snapshot is created from git commit if any of character's sprites were changed. It combines new(updated) sprites of specific character in a single spritesheet. If not all sprites for given character were changed, the existing sprites used to fill out missing frames to create a complete spritesheet with all required sprites for given character. Spritesheet is `.webp` file with grid-based sprite placement (rows - angles, columns - frames) and complimentary data, such as git metadata for commit and authorship of each sprite