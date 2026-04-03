//! `cargo run --example print_game_enum_json` — serde_json shape for plain enums.
use serde::Serialize;

#[derive(Serialize)]
enum Category {
    Game,
    App,
}

#[derive(Serialize)]
enum LaunchType {
    Executable,
    Steam,
}

#[derive(Serialize)]
struct GameShell {
    category: Category,
    launch_type: LaunchType,
}

fn main() {
    let g = GameShell {
        category: Category::App,
        launch_type: LaunchType::Executable,
    };
    println!("{}", serde_json::to_string(&g).unwrap());
}
