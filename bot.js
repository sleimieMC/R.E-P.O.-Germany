const client = require("./main");
const { Riffy } = require("riffy");
const { EmbedBuilder } = require('discord.js');
const fs = require("fs");
const { Classic } = require("musicard");
const { prefix } = require('./config.json');

// Ersetzen des Nodes mit einem öffentlichen Lavalink-Node
const nodes = [
    {
        host: "lavalink.oops.wtf",
        port: 443,
        password: "www.freelavalink.ga",
        secure: true
    },
];

client.riffy = new Riffy(client, nodes, {
    send: (payload) => {
        const guild = client.guilds.cache.get(payload.d.guild_id);
        if (guild) guild.shard.send(payload);
    },
    defaultSearchPlatform: "ytmsearch",
    restVersion: "v4"
});

client.on("ready", () => {
    console.log(`✅ Bot ${client.user.tag} ist bereit!`);
    client.riffy.init(client.user.id);
});

// Message-Handler
client.on("messageCreate", async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    const args = message.content.slice(prefix.length).trim().split(" ");
    const command = args.shift().toLowerCase();

    if (command === "play") {
        if (!message.member.voice.channel) {
            return message.reply("🚫 Du musst einem Sprachkanal beitreten!");
        }

        const query = args.join(" ");
        if (!query) return message.reply("❌ Bitte gib einen Songnamen oder Link an.");

        let player = client.riffy.players.get(message.guild.id);
        if (!player) {
            player = client.riffy.createConnection({
                guildId: message.guild.id,
                voiceChannel: message.member.voice.channel.id,
                textChannel: message.channel.id,
                deaf: true
            });
        }

        const resolve = await client.riffy.resolve({ query, requester: message.author });
        if (!resolve || !resolve.tracks.length) {
            return message.reply("❌ Keine Songs gefunden.");
        }

        const { loadType, tracks, playlistInfo } = resolve;
        if (loadType === 'playlist') {
            tracks.forEach(track => {
                track.info.requester = message.author;
                player.queue.add(track);
            });

            const embed = new EmbedBuilder()
                .setAuthor({ name: '🎵 Playlist zur Warteschlange hinzugefügt', iconURL: message.author.displayAvatarURL() })
                .setDescription(`**Playlist:** ${playlistInfo.name}\n**Tracks:** ${tracks.length}`)
                .setColor('#14bdff');
            message.reply({ embeds: [embed] });
        } else {
            const track = tracks[0];
            track.info.requester = message.author;
            player.queue.add(track);

            const embed = new EmbedBuilder()
                .setAuthor({ name: '🎶 Song zur Warteschlange hinzugefügt', iconURL: message.author.displayAvatarURL() })
                .setDescription(`**${track.info.title}** von **${track.info.author}**`)
                .setColor('#14bdff');
            message.reply({ embeds: [embed] });
        }

        if (!player.playing && !player.paused) player.play();
    }

    if (command === "pause") {
        const player = client.riffy.players.get(message.guild.id);
        if (!player || !player.playing) return message.reply("🚫 Kein Song läuft aktuell.");

        player.pause(true);
        message.reply({ embeds: [new EmbedBuilder().setColor('#2b71ec').setDescription('⏸ **Musik pausiert!**')] });
    }

    if (command === "resume") {
        const player = client.riffy.players.get(message.guild.id);
        if (!player || !player.paused) return message.reply("🚫 Keine pausierte Musik zum Fortsetzen.");

        player.pause(false);
        message.reply({ embeds: [new EmbedBuilder().setColor('#2b71ec').setDescription('▶ **Musik fortgesetzt!**')] });
    }

    if (command === "skip") {
        const player = client.riffy.players.get(message.guild.id);
        if (!player || !player.playing) return message.reply("🚫 Kein Song läuft.");

        player.stop();
        message.reply({ embeds: [new EmbedBuilder().setColor('#2b71ec').setDescription('⏭ **Song übersprungen!**')] });
    }

    if (command === "queue") {
        const player = client.riffy.players.get(message.guild.id);
        if (!player || player.queue.size === 0) return message.reply("🚫 Die Warteschlange ist leer.");

        const queueList = player.queue.map((track, index) => `${index + 1}. ${track.info.title}`).join("\n");
        const embed = new EmbedBuilder()
            .setColor('#2b71ec')
            .setAuthor({ name: '📜 Warteschlange', iconURL: message.author.displayAvatarURL() })
            .setDescription(queueList.slice(0, 2000)); 

        message.channel.send({ embeds: [embed] });
    }

    if (command === "stop") {
        const player = client.riffy.players.get(message.guild.id);
        if (!player) return message.reply("🚫 Kein Player aktiv.");

        player.disconnect();
        message.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('🛑 **Musik gestoppt!**')] });
    }
});

// Lavalink Event-Handling
client.riffy.on("nodeConnect", node => console.log(`✅ Node "${node.name}" verbunden!`));
client.riffy.on("nodeError", (node, error) => console.log(`❌ Fehler in Node "${node.name}": ${error.message}`));

client.riffy.on("trackStart", async (player, track) => {
    const musicard = await Classic({
        thumbnailImage: track.info.thumbnail,
        backgroundColor: "#070707",
        backgroundImage: "https://cdn.discordapp.com/attachments/1220001571228880917/1220001571690123284/01.png",
        nameColor: "#FF7A00",
        progressColor: "#FF7A00",
        progressBarColor: "#5F2D00",
        progress: 50,
        name: track.info.title,
        author: `By ${track.info.author}`,
        authorColor: "#696969",
        startTime: "0:00",
        endTime: "4:00",
        timeColor: "#FF7A00"
    });

    fs.writeFileSync("musicard.png", musicard);

    const embed = new EmbedBuilder()
        .setColor("#FF7A00")
        .setAuthor({ name: '🎵 Jetzt spielt', iconURL: track.info.thumbnail })
        .setDescription(`**${track.info.title}** von **${track.info.author}**`)
        .setImage("attachment://musicard.png");

    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send({ embeds: [embed], files: ["musicard.png"] });
});

client.riffy.on("queueEnd", (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send({ embeds: [new EmbedBuilder().setColor('#ffcc00').setDescription('🛑 **Warteschlange beendet.**')] });
    player.destroy();
});

client.on("raw", (d) => client.riffy.updateVoiceState(d));
