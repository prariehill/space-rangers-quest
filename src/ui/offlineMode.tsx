import * as React from "react";
import { Loader, DivFadeinCss } from "./common";
import { LangTexts } from "./lang";
import { Progress } from "reactstrap";

import { observer } from "mobx-react";
import { Store } from "./store";
import { SKIP_WAITING_MESSAGE_DATA } from "./consts";

declare global {
    interface Navigator {
        storage?: {
            estimate: () => Promise<{ quota: number; usage: number }>;
            persisted: () => Promise<boolean>;
            persist: () => Promise<boolean>;
        };
    }
}

interface StorageUsedInfoState {
    quota?: number;
    usage?: number;
}
class StorageUsedInfo extends React.Component<
    {
        l: LangTexts;
    },
    StorageUsedInfoState
> {
    timer: number | undefined;
    state: StorageUsedInfoState = {};
    componentWillMount() {
        this.timer = window.setInterval(this.updateInfo, 1000);
    }
    componendWillUnmount() {
        clearInterval(this.timer);
    }
    updateInfo = () => {
        if (navigator.storage) {
            navigator.storage
                .estimate()
                .then(({ quota, usage }) => this.setState({ quota, usage }))
                .catch(e => console.warn(e));
        }
    };
    render() {
        const l = this.props.l;
        if (this.state.quota === undefined || this.state.usage === undefined) {
            return <span>{l.storageUsed} ???</span>;
        }
        return (
            <span>
                {l.storageUsed} {Math.round(this.state.usage / 1000000)}mb{" "}
                {l.storageUsedFrom} {Math.round(this.state.quota / 1000000)}mb
            </span>
        );
    }
}

@observer
export class OfflineModeTabContainer extends React.Component<
    {
        store: Store;
    },
    {}
> {
    render() {
        const store = this.props.store;
        const l = store.l;
        return (
            <DivFadeinCss
                key="offlinemode"
                className="text-center container my-3"
            >
                {store.serviceWorkerController ? (
                    <>
                        <h5>
                            <i className="fa fa-check" />{" "}
                            {l.engineInstalledAndInOfflineMode}
                        </h5>
                        {store.installingServiceWorkerState ? (
                            <h6>
                                <i className="fa fa-spin fa-circle-o-notch" />{" "}
                                {l.installingEngineUpdate}
                            </h6>
                        ) : store.waitingServiceWorkerState &&
                        store.waitingServiceWorker ? (
                            <h6>
                                <a
                                    href="#"
                                    onClick={e => {
                                        e.preventDefault();
                                        if (store.waitingServiceWorker) {
                                            store.waitingServiceWorker.postMessage(
                                                SKIP_WAITING_MESSAGE_DATA
                                            );
                                        }
                                    }}
                                >
                                    <i className="fa fa-refresh" />{" "}
                                    {l.engineUpdatedNeedReload}
                                </a>
                            </h6>
                        ) : null}
                    </>
                ) : store.installingServiceWorkerState ? (
                    <h5>
                        <i className="fa fa-spin fa-circle-o-notch" />{" "}
                        {l.installingEngine}
                    </h5>
                ) : store.waitingServiceWorkerState ||
                store.activeServiceWorkerState ? (
                    <h5>
                        <a
                            href="#"
                            onClick={e => {
                                e.preventDefault();
                                location.reload();
                            }}
                        >
                            <i className="fa fa-refresh" />{" "}
                            {l.engineInstalledNeedReload}
                        </a>
                    </h5>
                ) : (
                    <h5 className="text-danger">
                        <i className="fa fa-times" /> {l.installEngineError}
                    </h5>
                )}
                <div className="">
                    <small>
                        {store.storageIsPersisted === undefined ? 
                        l.storePersistedUnknown : store.storageIsPersisted
                            ? l.storePersisted
                            : l.storeNotPersisted}
                    </small>
                </div>
                <div className="mb-4">
                    <small>
                        <StorageUsedInfo l={store.l} />
                    </small>
                </div>

                <div>
                    <i>{l.cacheImagesMusicInfo}</i>
                </div>
                <div className="card-group">
                    <div className="card">
                        <div className="card-header">{l.images}</div>
                        <div className="card-body">
                            {store.imagesCacheInstallInfo ? (
                                <>
                                    <p className="card-text">
                                        {l.installing}{" "}
                                        {
                                            store.imagesCacheInstallInfo
                                                .currentFile
                                        }
                                    </p>
                                    <Progress
                                        value={
                                            (store.imagesCacheInstallInfo
                                                .downloaded /
                                                store.imagesCacheInstallInfo
                                                    .sizeTotal) *
                                            100
                                        }
                                    />
                                </>
                            ) : store.imagesCache === "yes" ? (
                                <>
                                    <p className="card-text">{l.installed}</p>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() =>
                                            store.removeImagesCache()
                                        }
                                    >
                                        {l.uninstall}
                                    </button>
                                </>
                            ) : store.imagesCache === "no" ? (
                                <>
                                    <p className="card-text">
                                        {l.notInstalled}
                                    </p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() =>
                                            store.installImagesCache()
                                        }
                                    >
                                        {l.install}
                                    </button>
                                </>
                            ) : (
                                <Loader />
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">{l.music}</div>
                        <div className="card-body">
                            {store.musicCacheInstallInfo ? (
                                <>
                                    <p className="card-text">
                                        {l.installing}{" "}
                                        {
                                            store.musicCacheInstallInfo
                                                .currentFile
                                        }
                                    </p>
                                    <Progress
                                        value={
                                            (store.musicCacheInstallInfo
                                                .downloaded /
                                                store.musicCacheInstallInfo
                                                    .sizeTotal) *
                                            100
                                        }
                                    />
                                </>
                            ) : store.musicCache === "yes" ? (
                                <>
                                    <p className="card-text">{l.installed}</p>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => store.removeMusicCache()}
                                    >
                                        {l.uninstall}
                                    </button>
                                </>
                            ) : store.musicCache === "no" ? (
                                <>
                                    <p className="card-text">
                                        {l.notInstalled}
                                    </p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() =>
                                            store.installMusicCache()
                                        }
                                    >
                                        {l.install}
                                    </button>
                                </>
                            ) : (
                                <Loader />
                            )}
                        </div>
                    </div>
                </div>
            </DivFadeinCss>
        );
    }
}
