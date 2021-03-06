let ws = io.connect('//' + document.domain + ':' + location.port);
let filelist = $('#file-listing').find('tbody');
let passphrase = "typical";
let progress = $('#progressmain');
let progressdiv = $('#progressdivmain');
progressdiv.hide();

let dropzone = $('#drop-zone');

$(document).on("click", ".file-action", e => {
    let target = e.target.id.split('-');
    if (target[0] == 'download')
        fetch_manifest(target[1]);
    else
        delete_manifest(target[1]);
});

let instance = null;
let priv = localStorage.getItem('privkey');
if (priv != null) {
    console.log("Loading key");
    kbpgp.KeyManager.import_from_armored_pgp({armored: priv}, (err, ins) => {
        console.log(err);
        if (ins.is_pgp_locked)
            ins.unlock_pgp({
                passphrase: passphrase
            }, e => {});
        instance = ins;
    });
} else {
    progressdiv.show();
    progress.attr('style', 'width: 100%');
    progress.text("Generating key...");
    kbpgp.KeyManager.generate_ecc({userid: "Bo Jackson <user@example.com>"}, (err, ins) => {
        instance = ins;
        console.log("Done generating key.");
        ins.sign({}, err => {
            ins.export_pgp_private({passphrase: passphrase}, (err, key) => {
                localStorage.setItem('privkey', key);
            });
        });
        progressdiv.hide();
        progress.attr('style', 'width: 0%');
    });
}

$('#js-upload-form').on('submit', handle_upload);
dropzone.on("drop", handle_upload);
dropzone.on("dragover", () => {
    dropzone.attr('class', 'upload-drop-zone drop');
    return false;
});
dropzone.on("dragleave", () => {
    dropzone.attr('class', 'upload-drop-zone');
    return false;
});

function handle_upload(e) {
    progress.attr('style', 'width: 100%');
    progress.addClass('bg-success');
    progress.text('Encrypting...');
    progressdiv.show();
    e.preventDefault();
    // prevent browser default behavior on drop
    dropzone.attr('class', 'upload-drop-zone');

    let files = null;
    if (e.originalEvent.dataTransfer != null)
        files = e.originalEvent.dataTransfer.files;
    else
        files = $('#js-upload-files')[0].files;

    // iterate over the files dragged on to the browser
    for (let x = 0; x < files.length; x++) {

        // instantiate a new FileReader object
        let fr = new FileReader();
        let file = files[x];
        fr.name = file.name;


        // loading files from the file system is an asynchronous
        // operation, run this function when the loading process
        // is complete
        fr.addEventListener("loadend", () => {
            // send the file over web sockets
            let crypt_params = {
                msg: base64ArrayBuffer(fr.result),
                encrypt_for: instance,
                sign_with: instance,
            };
            kbpgp.box(crypt_params, (err, string, buf) => {
                progress.removeClass('bg-success');
                progress.text('Uploading...');
                ws.emit('dropzone', {
                        file: string,
                        name: fr.name,
                        count: 3
                    },
                    record_file);
            });
        });

        fr.readAsArrayBuffer(file);
    }
}