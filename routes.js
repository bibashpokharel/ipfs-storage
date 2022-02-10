const shortid = require("short-id");
const fs = require("fs/promises");
const IPFS = require("ipfs-api");
const ipfs = new IPFS({ host: "ipfs.infura.io", port: 5001, protocol: "https" });

function routes(app, dbe, lms, accounts) {
	let db = dbe.collection("users");
	let fileStorage = dbe.collection("file-store");

	app.post("/register", (req, res) => {
		let email = req.body.email;
		let idd = shortid.generate();
		if (email) {
			db.findOne({ email }, (err, doc) => {
				if (doc) {
					res.status(400).json({ status: "Failed", reason: "Already registered" });
				} else {
					db.insertOne({ email });
					res.json({ status: "success", id: idd });
				}
			});
		} else {
			res.status(400).json({ status: "Failed", reason: "wrong input" });
		}
	});

	app.post("/login", (req, res) => {
		let email = req.body.email;
		if (email) {
			db.findOne({ email }, (err, doc) => {
				if (doc) {
					res.json({ status: "success", id: doc.id });
				} else {
					res.status(400).json({ status: "Failed", reason: "Not recognised" });
				}
			});
		} else {
			res.status(400).json({ status: "Failed", reason: "wrong input" });
		}
	});
	app.post("/upload", async (req, res) => {
		try {
			console.log("req body", req.body);
			let filePath = req.body.filePath;
			let name = req.body.name;
			let title = req.body.title;
			let id = shortid.generate() + shortid.generate();
			if (filePath && title) {
				const readFile = await fs.readFile(filePath);
				console.log("read file buffer", readFile);
				let ipfsHash = await ipfs.add(readFile);
				console.log("ipfsHash", ipfsHash);
				let hash = ipfsHash[0].hash;
				lms.sendIPFS(id, hash, { from: accounts[0] })
					.then((_hash, _address) => {
						fileStorage.insertOne({ id, hash, title, name });
						res.json({ status: "success", id, hash: _hash, address: _address });
					})
					.catch((err) => {
						res.status(500).json({ status: "Failed", reason: "Upload error occured" });
					});
			} else {
				res.status(400).json({ status: "Failed", reason: "wrong input" });
			}
		} catch (error) {
			console.log("error inside upload ipfs", error);
		}
	});
	app.get("/access/:email", (req, res) => {
		if (req.params.email) {
			db.findOne({ email: req.params.email }, async (err, doc) => {
				if (err) {
					return res.json({ status: "failed", err });
				}
				console.log("docs", doc);
				if (doc) {
					let data = await fileStorage.find().toArray();
					return res.json({ status: "success", data });
				}
			});
		} else {
			res.status(400).json({ status: "Failed", reason: "wrong input" });
		}
	});
	app.get("/access/:email/:id", async (req, res) => {
		let id = req.params.id;
		if (req.params.id && req.params.email) {
			db.findOne({ email: req.body.email }, (err, doc) => {
				if (doc) {
					lms.getHash(id, { from: accounts[0] }).then(async (hash) => {
						console.log(hash);
						let data = await ipfs.files.get(hash);
						console.log(data);
						res.json({ status: "success", data: data.content });
					});
				} else {
					res.status(400).json({ status: "Failed", reason: "wrong input" });
				}
			});
		} else {
			res.status(400).json({ status: "Failed", reason: "wrong input" });
		}
	});
}

module.exports = routes;
