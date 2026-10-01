use serde::Serialize;

/// Error shape the frontend understands. `kind` is one of
/// `invalid_input`, `disconnected`, `unknown`, `internal`.
#[derive(Debug, PartialEq, Serialize)]
pub struct AppError {
    pub kind: &'static str,
    pub message: String,
}

impl AppError {
    fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("invalid_input", message)
    }

    /// The command was certainly not sent (connect or auth failed).
    pub fn disconnected(message: impl Into<String>) -> Self {
        Self::new("disconnected", message)
    }

    /// The command was sent but the reply was missing or incomplete.
    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new("unknown", message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("internal", message)
    }
}
