use std::{path::PathBuf, sync::mpsc::channel};

use anyhow::Result;

use crate::{
    gui_util::WorkerSession,
    messages::{LogPage, RepoConfig},
    worker::{Session, SessionEvent},
};

#[test]
fn start_and_stop() -> Result<()> {
    let (tx, rx) = channel::<SessionEvent>();
    tx.send(SessionEvent::EndSession)?;
    WorkerSession::default().handle_events(&rx)?;
    Ok(())
}

#[test]
fn load_repo() -> Result<()> {
    let (tx, rx) = channel::<SessionEvent>();
    let (tx_good_repo, rx_good_repo) = channel::<Result<RepoConfig>>();
    let (tx_bad_repo, rx_bad_repo) = channel::<Result<RepoConfig>>();

    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_good_repo,
        cwd: None,
    })?;
    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_bad_repo,
        cwd: Some(PathBuf::new()),
    })?;
    tx.send(SessionEvent::EndSession)?;

    WorkerSession::default().handle_events(&rx)?;

    let config = rx_good_repo.recv()??;
    assert!(matches!(config, RepoConfig::Workspace { .. }));

    let config = rx_bad_repo.recv()??;
    assert!(matches!(config, RepoConfig::NoWorkspace { .. }));

    Ok(())
}

#[test]
fn reload_repo() -> Result<()> {
    let (tx, rx) = channel::<SessionEvent>();
    let (tx_first_repo, rx_first_repo) = channel::<Result<RepoConfig>>();
    let (tx_second_repo, rx_second_repo) = channel::<Result<RepoConfig>>();

    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_first_repo,
        cwd: None,
    })?;
    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_second_repo,
        cwd: None,
    })?;
    tx.send(SessionEvent::EndSession)?;

    WorkerSession::default().handle_events(&rx)?;

    let config = rx_first_repo.recv()??;
    assert!(matches!(config, RepoConfig::Workspace { .. }));

    let config = rx_second_repo.recv()??;
    assert!(matches!(config, RepoConfig::Workspace { .. }));

    Ok(())
}

#[test]
fn reload_with_default_query() -> Result<()> {
    let (tx, rx) = channel::<SessionEvent>();
    let (tx_load, rx_load) = channel::<Result<RepoConfig>>();
    let (tx_query, rx_query) = channel::<Result<LogPage>>();
    let (tx_reload, rx_reload) = channel::<Result<RepoConfig>>();

    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_load,
        cwd: None,
    })?;
    tx.send(SessionEvent::QueryLog {
        tx: tx_query,
        query: "none()".to_owned(),
    })?;
    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_reload,
        cwd: None,
    })?;
    tx.send(SessionEvent::EndSession)?;

    WorkerSession::default().handle_events(&rx)?;

    _ = rx_load.recv()??;
    _ = rx_query.recv()??;
    let config = rx_reload.recv()??;
    assert!(
        matches!(config, RepoConfig::Workspace { latest_query, .. } if latest_query == "none()")
    );

    Ok(())
}

#[test]
fn evaluate_query() -> Result<()> {
    let (tx, rx) = channel::<SessionEvent>();
    let (tx_load, rx_load) = channel::<Result<RepoConfig>>();
    let (tx_query, rx_query) = channel::<Result<LogPage>>();

    tx.send(SessionEvent::OpenWorkspace {
        tx: tx_load,
        cwd: None,
    })?;
    tx.send(SessionEvent::QueryLog {
        tx: tx_query,
        query: "@".to_owned(),
    })?;
    tx.send(SessionEvent::EndSession)?;

    WorkerSession::default().handle_events(&rx)?;

    _ = rx_load.recv()??;
    let page = rx_query.recv()??;
    assert_eq!(1, page.rows.len());

    Ok(())
}

#[test]
fn snapshot_harness() -> Result<()> {
    let mut session = WorkerSession::default();
    let mut ws = session.load_directory(&std::env::current_dir()?)?;
    ws.snapshot_working_copy()?;
    Ok(())
}
